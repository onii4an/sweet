class UsersController < ApplicationController
  before_action :check_user
  helper_method :user

  def show; end

  def user
    @user ||= User.find(params[:id]) unless User.find(params[:id]).type == "Admin"
  end

  private

  def check_user
    redirect_to root_path unless current_user || current_admin
  end
end
