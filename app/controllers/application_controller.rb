class ApplicationController < ActionController::Base
  protect_from_forgery with: :exception
  before_action { |_c| current_boy.track unless current_boy.nil? }
  before_action { |_c| current_girl.track unless current_girl.nil? }
  before_action :configure_permitted_parameters, if: :devise_controller?
  before_action :ban_filter
  before_action :update_online
  helper_method :current_user
  helper_method :current_conversation

  def current_user
    if current_girl
      current_girl
    elsif current_boy
      current_boy
    end
  end

  def current_conversation
    if current_boy
      Conversation.where(boy_id: current_boy.id).last
    elsif current_girl
      Conversation.where(girl_id: current_girl.id).last
    end
  end

  protected

  def configure_permitted_parameters
    added_attrs = %i[username email password password_confirmation remember_me name surname age avatar avatar_cache remove_avatar intro]
    devise_parameter_sanitizer.permit :sign_up, keys: added_attrs
    devise_parameter_sanitizer.permit :account_update, keys: added_attrs
  end

  def ban_filter
    redirect_to banned_path if current_user&.status == 'banned' && controller_name != 'ban'
  end

  def update_online
    OnlineJob.perform_later('update', Boy.online.count, Girl.online.count)
  end
end
