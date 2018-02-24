class AdminSearchController < ApplicationController
  before_action :check_admin
  helper_method :find_cvs
  helper_method :boy_nickname
  helper_method :girl_nickname

  def cv_search; end

  def find_cvs
    if !params[:boy_nickname].empty? && !params[:girl_nickname].empty?
      @conversations = Conversation.where(boy_id: Boy.find_by_username(params[:boy_nickname]).id, girl_id: Girl.find_by_username(params[:girl_nickname]).id)
    elsif !params[:boy_nickname].empty?
      @conversations = Conversation.where(boy_id: Boy.find_by_username(params[:boy_nickname]).id)
    elsif !params[:girl_nickname].empty?
      @conversations = Conversation.where(girl_id: Girl.find_by_username(params[:girl_nickname]).id)
    else
      @conversations = Conversation.all
    end
  end

  def boy_nickname
    params[:boy_nickname]
  end

  def girl_nickname
    params[:girl_nickname]
  end

  private

  def check_admin
    redirect_to root_path unless current_admin
  end
end
